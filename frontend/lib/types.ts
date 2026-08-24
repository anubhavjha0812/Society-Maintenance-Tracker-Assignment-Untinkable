export type Role = "resident" | "society_admin" | "super_admin";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  societyId: string;
}
