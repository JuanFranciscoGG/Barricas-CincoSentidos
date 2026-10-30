// The database stores these as plain strings (no native enums), so these are the single source of truth for
// every "enum-shaped" string column in prisma/schema.prisma. Keep in sync.

export const ROLES = ["owner_admin", "enologo", "comercial", "customer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner_admin: "Dirección",
  enologo: "Enólogo",
  comercial: "Comercial",
  customer: "Cliente",
};

export const PROJECT_STATUSES = ["planning", "aging", "bottled", "delivered"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "En definición",
  aging: "En crianza",
  bottled: "Embotellado",
  delivered: "Entregado",
};

export const BARREL_STATUSES = ["filled", "empty", "retired"] as const;
export type BarrelStatus = (typeof BARREL_STATUSES)[number];

export const BARREL_STATUS_LABELS: Record<BarrelStatus, string> = {
  filled: "Con vino",
  empty: "Vacía",
  retired: "Retirada",
};

export const TOAST_LEVELS = ["light", "medium", "medium_plus", "heavy"] as const;
export type ToastLevel = (typeof TOAST_LEVELS)[number];

export const TOAST_LEVEL_LABELS: Record<ToastLevel, string> = {
  light: "Tueste ligero",
  medium: "Tueste medio",
  medium_plus: "Tueste medio-alto",
  heavy: "Tueste fuerte",
};

export const LABEL_STATUSES = ["undecided", "standard", "personalized", "in_progress"] as const;
export type LabelStatus = (typeof LABEL_STATUSES)[number];

export const LABEL_STATUS_LABELS: Record<LabelStatus, string> = {
  undecided: "Sin decidir",
  standard: "Etiqueta estándar",
  personalized: "Etiqueta personalizada",
  in_progress: "En diseño",
};

export const NOTIFICATION_CHANNELS = ["app", "email", "manual"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const MEDIA_TYPES = ["photo", "video", "audio"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const KNOWLEDGE_STATUSES = ["draft", "published", "archived"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

/** Roles allowed to log in to the staff admin area at /dashboard. */
export const STAFF_ROLES: Role[] = ["owner_admin", "enologo", "comercial"];

export function isStaff(role: string): boolean {
  return (STAFF_ROLES as string[]).includes(role);
}
