/* BMONI Embedded — domain types (Phase 1 shapes, mirrored in docs/api-contracts.md) */

export type KycStatus =
  | "NOT_STARTED" | "IN_PROGRESS" | "PENDING" | "VERIFIED"
  | "REJECTED" | "RETRY_REQUIRED" | "EXPIRED";

export type RailType = "SEPA" | "ACH" | "FPS" | "WIRE";

export type RailStatus = "VALIDATING" | "ACTIVE" | "FAILED" | "DEACTIVATED";

export type BeneficiaryStatus = "PENDING" | "VERIFIED" | "REJECTED" | "DEACTIVATED";

export type FundingStatus =
  | "CREATED" | "REQUIRES_ACTION" | "PROCESSING" | "SUCCEEDED"
  | "FAILED" | "CANCELLED" | "EXPIRED";

export type TransferStatus =
  | "CREATED" | "PENDING" | "PROCESSING" | "COMPLETED"
  | "FAILED" | "CANCELLED" | "REVERSED";

export type FundingMethod = "CARD" | "BANK_TRANSFER" | "OPEN_BANKING";
export type TransferKind = "SEND" | "WITHDRAW" | "INTERNAL";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "ACTIVE" | "RESTRICTED";
  createdAt: number;
}

export interface Device {
  id: string;
  label: string;
  location: string;
  lastActive: number;
  current: boolean;
}

export interface StateEvent { state: string; at: number; note?: string; }

export interface KycProfile {
  userId: string;
  status: KycStatus;
  attempts: number;
  personalInfo?: {
    legalName: string; dob: string; addressLine1: string;
    city: string; postalCode: string; country: string; idNumber: string;
  };
  documentType?: "PASSPORT" | "DRIVERS_LICENSE" | "NATIONAL_ID";
  events: StateEvent[];
  reason?: string;
}

export interface RailAccount {
  id: string;
  userId: string;
  rail: RailType;
  institution: string;
  accountMasked: string;
  status: RailStatus;
  failReason?: string;
  addedAt: number;
  events: StateEvent[];
}

export interface Beneficiary {
  id: string;
  userId: string;
  name: string;
  rail: RailType;
  accountMasked: string;
  institution: string;
  status: BeneficiaryStatus;
  failReason?: string;
  createdAt: number;
  events: StateEvent[];
}

export interface FundingIntent {
  id: string;
  userId: string;
  method: FundingMethod;
  amountCents: number;
  feeCents: number;
  status: FundingStatus;
  failReason?: string;
  providerRef: string;
  referenceCode?: string;
  createdAt: number;
  events: StateEvent[];
}

export interface Transfer {
  id: string;
  userId: string;
  kind: TransferKind;
  amountCents: number;
  feeCents: number;
  destination: string;        // beneficiary name / own rail / internal email
  note?: string;
  status: TransferStatus;
  failReason?: string;
  providerRef: string;
  createdAt: number;
  events: StateEvent[];
}

export type EntryType = "CREDIT" | "DEBIT" | "FEE" | "RESERVE" | "RELEASE";
export type EntryStatus = "POSTED" | "PENDING" | "RELEASED";

export interface LedgerEntry {
  id: string;
  userId: string;
  ts: number;
  description: string;
  counterparty: string;
  amountCents: number;        // signed
  type: EntryType;
  status: EntryStatus;
  refKind: "FUNDING" | "TRANSFER" | "ADJUSTMENT";
  refId: string;
}

export interface WalletView {
  id: string;
  currency: "USD";
  status: "ACTIVE" | "FROZEN";
  availableCents: number;
  pendingCents: number;
  createdAt: number;
}

export interface Noti {
  id: string;
  userId: string;
  ts: number;
  title: string;
  body: string;
  kind: "success" | "warning" | "info" | "error";
  read: boolean;
}

export interface Transaction {
  id: string;
  ts: number;
  title: string;
  counterparty: string;
  amountCents: number;        // signed gross
  feeCents: number;
  status: string;
  kind: "FUNDING" | "TRANSFER";
  subKind: FundingMethod | TransferKind;
  providerRef: string;
  events: StateEvent[];
  entries: LedgerEntry[];
}

export interface Snapshot {
  user: User | null;
  wallet: WalletView | null;
  kyc: KycProfile | null;
  rails: RailAccount[];
  beneficiaries: Beneficiary[];
  funding: FundingIntent[];
  transfers: Transfer[];
  transactions: Transaction[];
  notifications: Noti[];
  devices: Device[];
}

export class ApiError extends Error {
  fields?: Record<string, string>;
  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.fields = fields;
  }
}
