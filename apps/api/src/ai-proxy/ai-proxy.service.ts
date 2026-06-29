import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DiagnosticWebhookDto } from './dto/diagnostic-webhook.dto';
import { NotificationType, Urgency } from '../generated/prisma';

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {}

  private get aiUrl() {
    return this.config.getOrThrow<string>('AI_SERVICE_URL');
  }

  private get aiHeaders() {
    return { 'x-internal-secret': this.config.getOrThrow<string>('AI_SERVICE_SECRET') };
  }

  // ─── Called by patient before opening the chat WebSocket ──────────────────

  async startChatSession(patientId: string) {
    const langgraphThreadId = randomUUID();

    const session = await this.prisma.chatSession.create({
      data: { patientId, langgraphThreadId, status: 'ACTIVE' },
    });

    return {
      chatSessionId: session.id,
      langgraphThreadId: session.langgraphThreadId,
      // Frontend uses this to open the WebSocket directly to FastAPI via NGINX
      wsPath: `/ai/chat/${session.id}`,
    };
  }

  // ─── Webhook from FastAPI: pre-diagnostic was saved to Supabase ───────────

  async handleDiagnosticComplete(dto: DiagnosticWebhookDto) {
    const diagnostic = await this.prisma.preDiagnostic.findUnique({
      where: { id: dto.preDiagnosticId },
      include: { patient: { include: { profile: true } } },
    });
    if (!diagnostic) {
      this.logger.warn(`Webhook received for unknown preDiagnosticId: ${dto.preDiagnosticId}`);
      return;
    }

    const urgencyMessages: Record<Urgency, string> = {
      LOW: 'Your pre-screening is complete. A doctor will review it soon.',
      MEDIUM: 'Your pre-screening is ready. A doctor will review it shortly.',
      HIGH: 'Your pre-screening flagged elevated concern. A doctor will prioritise your case.',
      EMERGENCY: 'Your pre-screening flagged an emergency. Please seek immediate care or call emergency services.',
    };

    await this.notifications.send({
      recipientId: diagnostic.patient.profileId,
      type: NotificationType.DIAGNOSTIC_READY,
      title: 'Pre-screening Complete',
      body: urgencyMessages[dto.urgency],
      data: { preDiagnosticId: dto.preDiagnosticId, urgency: dto.urgency },
    });

    // Mark ChatSession as completed
    await this.prisma.chatSession.update({
      where: { id: diagnostic.chatSessionId },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });
  }

  // ─── Admin: trigger MedlinePlus/PubMed re-scrape on FastAPI ───────────────

  async triggerScraperRefresh() {
    try {
      const { data } = await firstValueFrom(
        this.http.post(
          `${this.aiUrl}/scraper/refresh`,
          {},
          { headers: this.aiHeaders },
        ),
      );
      return data;
    } catch (err) {
      this.logger.error('Scraper refresh failed', err);
      throw err;
    }
  }

  // ─── Face enroll: proxy multipart upload to FastAPI, then set face_registered ─

  async enrollFace(doctorId: string, req: FastifyRequest): Promise<unknown> {
    const formData = new FormData();
    formData.append('doctor_id', doctorId);

    // @fastify/multipart adds .files() to the request
    const parts = (req as any).files() as AsyncIterable<any>;
    let fileCount = 0;
    for await (const part of parts) {
      const buffer: Buffer = await part.toBuffer();
      formData.append('photos', new Blob([new Uint8Array(buffer)], { type: part.mimetype }), part.filename);
      fileCount++;
    }

    if (fileCount === 0) throw new BadRequestException('At least one photo is required');

    const { data } = await firstValueFrom(
      this.http.post(`${this.aiUrl}/face/enroll`, formData, {
        headers: this.aiHeaders,
      }),
    );

    await this.prisma.doctor.update({
      where: { id: doctorId },
      data: { faceRegistered: true },
    });

    this.logger.log(`Face enrolled for doctor ${doctorId} (${fileCount} photo(s))`);
    return data;
  }

  // ─── Face verify: proxy single photo to FastAPI (used as 2FA after JWT login) ─

  async verifyFace(doctorId: string, req: FastifyRequest): Promise<unknown> {
    const part = await (req as any).file() as any;
    if (!part) throw new BadRequestException('Photo is required');

    const buffer: Buffer = await part.toBuffer();
    const formData = new FormData();
    formData.append('doctor_id', doctorId);
    formData.append('photo', new Blob([new Uint8Array(buffer)], { type: part.mimetype }), part.filename);

    const { data } = await firstValueFrom(
      this.http.post(`${this.aiUrl}/face/verify`, formData, {
        headers: this.aiHeaders,
      }),
    );

    this.logger.log(`Face verify for doctor ${doctorId}: success=${(data as any).success}`);
    return data;
  }

  // ─── Internal: get a chat session (used by AI side for context) ───────────

  async getChatSession(chatSessionId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: chatSessionId },
      include: { patient: { include: { profile: true } } },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    return session;
  }
}
