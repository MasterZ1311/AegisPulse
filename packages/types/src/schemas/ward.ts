import { z } from 'zod';
import { BedStatusEnum, CodeStatusEnum, GenderEnum } from '../enums';
import { TimestampSchema } from '../provenance';
import { IsolationStatusEnum } from './clinical';

// ============================================================================
// 1. Patient Entity Schema
// ============================================================================
export const PatientSchema = z.object({
  id: z.string().min(1, 'Patient ID is required'),
  mrn: z.string().default('MRN-AUTO'),
  name: z.string().min(1, 'Patient full name is required'),
  age: z
    .number()
    .int('Age must be an integer')
    .min(0, 'Age cannot be negative')
    .max(125, 'Age exceeds human biological maximum'),
  gender: GenderEnum,
  wardId: z.string().default('WARD-GENERAL'),
  bedId: z.string().default('BED-UNASSIGNED'),
  bedNumber: z.string().min(1, 'Bed number is required'),
  admissionDiagnosis: z.string().min(1, 'Admission diagnosis is required'),
  admissionTimestamp: TimestampSchema,
  attendingPhysician: z.string().default('Staff Attending'),
  primaryNurse: z.string().optional(),
  codeStatus: CodeStatusEnum.default('FULL_CODE'),
  baselineMEWS: z
    .number()
    .int('Baseline MEWS must be an integer')
    .min(0, 'MEWS cannot be negative')
    .max(14, 'MEWS cannot exceed 14'),
  allergies: z.array(z.string()).default([]),
  isolationStatus: IsolationStatusEnum.default('NONE'),
  isActive: z.boolean().default(true),
  history: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
});
export type Patient = z.infer<typeof PatientSchema>;

export const CreatePatientSchema = z.object({
  id: z.string().optional(),
  mrn: z.string().optional(),
  name: z.string().min(1, 'Patient full name is required'),
  age: z
    .number()
    .int('Age must be an integer')
    .min(0, 'Age cannot be negative')
    .max(125, 'Age exceeds human biological maximum'),
  gender: GenderEnum,
  wardId: z.string().default('WARD-A'),
  bedId: z.string().optional(),
  bedNumber: z.string().min(1, 'Bed number is required'),
  admissionDiagnosis: z.string().min(1, 'Admission diagnosis is required'),
  admissionTimestamp: TimestampSchema.optional(),
  attendingPhysician: z.string().default('Staff Attending'),
  primaryNurse: z.string().optional(),
  codeStatus: CodeStatusEnum.default('FULL_CODE'),
  baselineMEWS: z
    .number()
    .int('Baseline MEWS must be an integer')
    .min(0, 'MEWS cannot be negative')
    .max(14, 'MEWS cannot exceed 14')
    .default(0),
  allergies: z.array(z.string()).default([]),
  isolationStatus: IsolationStatusEnum.default('NONE'),
  isActive: z.boolean().default(true),
  history: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
});
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;

export const UpdatePatientSchema = z.object({
  name: z.string().min(1).optional(),
  age: z.number().int().min(0).max(125).optional(),
  gender: GenderEnum.optional(),
  wardId: z.string().optional(),
  bedId: z.string().optional(),
  bedNumber: z.string().optional(),
  admissionDiagnosis: z.string().min(1).optional(),
  attendingPhysician: z.string().optional(),
  primaryNurse: z.string().optional(),
  codeStatus: CodeStatusEnum.optional(),
  baselineMEWS: z.number().int().min(0).max(14).optional(),
  allergies: z.array(z.string()).optional(),
  isolationStatus: IsolationStatusEnum.optional(),
  isActive: z.boolean().optional(),
  history: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
});
export type UpdatePatientInput = z.infer<typeof UpdatePatientSchema>;

// ============================================================================
// 2. Bed Entity Schema
// ============================================================================
export const BedSchema = z.object({
  id: z.string().min(1, 'Bed ID is required'),
  bedNumber: z.string().min(1, 'Bed number is required (e.g. 401-A)'),
  wardId: z.string().min(1, 'Ward ID is required'),
  roomNumber: z.string().min(1, 'Room number is required'),
  status: BedStatusEnum,
  currentPatientId: z.string().nullable().optional(),
  cameraDeviceId: z.string().optional(),
  monitorDeviceId: z.string().optional(),
  lastCleanedTimestamp: TimestampSchema.optional(),
});
export type Bed = z.infer<typeof BedSchema>;

// ============================================================================
// 3. Ward Entity Schema
// ============================================================================
export const WardSchema = z.object({
  id: z.string().min(1, 'Ward ID is required'),
  name: z.string().min(1, 'Ward name is required'),
  code: z.string().min(1, 'Ward code is required (e.g. SURG-4B)'),
  department: z.string().min(1, 'Department is required'),
  totalBeds: z
    .number()
    .int('Total beds must be an integer')
    .positive('Total beds must be at least 1')
    .max(100, 'Ward capacity cannot exceed 100 beds'),
  nurseRatio: z.string().regex(/^1:[0-9]+$/, 'Nurse ratio must be formatted as 1:N (e.g. 1:6)'),
  activeNursesCount: z
    .number()
    .int('Active nurses count must be an integer')
    .min(0, 'Active nurses count cannot be negative'),
  hospitalName: z.string().min(1, 'Hospital name is required'),
  isActive: z.boolean().default(true),
});
export type Ward = z.infer<typeof WardSchema>;
