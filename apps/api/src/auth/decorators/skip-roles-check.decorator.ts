import { SetMetadata } from '@nestjs/common';

export const SKIP_ROLES_KEY = 'skipRolesCheck';
export const SkipRolesCheck = () => SetMetadata(SKIP_ROLES_KEY, true);
