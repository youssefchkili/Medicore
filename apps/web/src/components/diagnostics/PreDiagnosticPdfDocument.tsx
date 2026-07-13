import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { parseAiReport } from "@/lib/parseAiReport";

type Condition = { condition: string; confidence?: string } | string;

export type PdfDiagnostic = {
  id: string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
  status: "PENDING_REVIEW" | "REVIEWED" | "ARCHIVED";
  suggestedSpecialty: string | null;
  possibleConditions: Condition[];
  rawReport: string;
  createdAt: string;
  doctorNotes: string | null;
  doctor?: { profile?: { firstName: string; lastName: string } | null } | null;
};

const URGENCY_LABEL: Record<PdfDiagnostic["urgency"], string> = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  EMERGENCY: "EMERGENCY",
};

const URGENCY_COLOR: Record<PdfDiagnostic["urgency"], string> = {
  LOW: "#059669",
  MEDIUM: "#D97706",
  HIGH: "#EA580C",
  EMERGENCY: "#BE123C",
};

const STATUS_LABEL: Record<PdfDiagnostic["status"], string> = {
  PENDING_REVIEW: "PENDING REVIEW",
  REVIEWED: "REVIEWED BY DOCTOR",
  ARCHIVED: "ARCHIVED",
};

function conditionName(c: Condition): string {
  return typeof c === "string" ? c : c.condition;
}
function conditionConfidence(c: Condition): string | null {
  return typeof c === "string" ? null : (c.confidence ?? null);
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0F172A",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#2563EB",
    paddingBottom: 16,
  },
  brand: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#2563EB",
  },
  brandSub: {
    fontSize: 9,
    color: "#64748B",
    marginTop: 2,
  },
  metaBlock: {
    alignItems: "flex-end",
  },
  metaLabel: {
    fontSize: 8,
    color: "#94A3B8",
  },
  metaValue: {
    fontSize: 9,
    color: "#0F172A",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  badge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    color: "#fff",
  },
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#94A3B8",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  conditionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  conditionName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  conditionConfidence: {
    fontSize: 8,
    color: "#64748B",
    textTransform: "uppercase",
  },
  specialtyBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#374151",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
  },
  reviewBox: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 8,
    padding: 12,
  },
  reviewDoctor: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#064E3B",
    marginBottom: 6,
  },
  reviewNotes: {
    fontSize: 10,
    lineHeight: 1.5,
    color: "#065F46",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#94A3B8",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
  },
});

export function PreDiagnosticPdfDocument({
  diag,
  patientName,
}: {
  diag: PdfDiagnostic;
  patientName: string;
}) {
  const conditions = Array.isArray(diag.possibleConditions) ? diag.possibleConditions : [];
  const generatedAt = new Date().toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const reportDate = new Date(diag.createdAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <Document title={`MediCore Pre-Diagnostic Report - ${patientName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>MediCore</Text>
            <Text style={styles.brandSub}>AI-Powered Telemedicine</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Patient</Text>
            <Text style={styles.metaValue}>{patientName}</Text>
            <Text style={styles.metaLabel}>Report Date</Text>
            <Text style={styles.metaValue}>{reportDate}</Text>
            <Text style={styles.metaLabel}>Report ID</Text>
            <Text style={styles.metaValue}>{diag.id}</Text>
          </View>
        </View>

        <Text style={styles.title}>Pre-Diagnostic Report</Text>
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, { backgroundColor: URGENCY_COLOR[diag.urgency] }]}>
            {URGENCY_LABEL[diag.urgency]} URGENCY
          </Text>
          <Text style={[styles.badge, { backgroundColor: "#64748B" }]}>
            {STATUS_LABEL[diag.status]}
          </Text>
        </View>

        {conditions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Possible Conditions</Text>
            {conditions.map((c, i) => {
              const conf = conditionConfidence(c);
              return (
                <View key={i} style={styles.conditionRow}>
                  <Text style={styles.conditionName}>{conditionName(c)}</Text>
                  {conf && <Text style={styles.conditionConfidence}>{conf} confidence</Text>}
                </View>
              );
            })}
          </View>
        )}

        {diag.suggestedSpecialty && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Suggested Specialty</Text>
            <View style={styles.specialtyBox}>
              <Text>{diag.suggestedSpecialty}</Text>
            </View>
          </View>
        )}

        {(() => {
          const parsed = parseAiReport(diag.rawReport);
          return (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>AI Report</Text>
                <Text style={styles.bodyText}>{parsed.symptomsSummary ?? parsed.raw}</Text>
              </View>
              {parsed.recommendations && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Recommendations</Text>
                  <Text style={styles.bodyText}>{parsed.recommendations}</Text>
                </View>
              )}
            </>
          );
        })()}

        {diag.status === "REVIEWED" && diag.doctorNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Doctor Review</Text>
            <View style={styles.reviewBox}>
              {diag.doctor?.profile && (
                <Text style={styles.reviewDoctor}>
                  Dr. {diag.doctor.profile.firstName} {diag.doctor.profile.lastName}
                </Text>
              )}
              <Text style={styles.reviewNotes}>{diag.doctorNotes}</Text>
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          AI-generated content is for informational purposes only and is not a substitute for
          professional medical advice, diagnosis, or treatment. Generated on {generatedAt}.
        </Text>
      </Page>
    </Document>
  );
}
