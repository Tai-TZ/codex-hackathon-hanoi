export type Role = 'parent' | 'child';
export type Risk = 'red' | 'yellow' | 'green';
export type EventKind = 'scam' | 'prescription' | 'document' | 'other' | 'emergency';

export interface PrescriptionItem {
  drug: string;
  dose: string;
  times: string[];
  note: string;
}

export interface PrescriptionQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface Prescription {
  items: PrescriptionItem[];
  questions: PrescriptionQuestion[];
}

export interface AskEvent {
  id: string;
  kind: EventKind;
  risk: Risk;
  confidence: number;
  title: string;
  answer: string;
  actions: string[];
  family_notified: boolean;
  prescription: Prescription | null;
  thread_id: string;
  created_at: string;
  question_text: string | null;
  image_url: string | null;
}

export interface ChildReply {
  id: number;
  event_id: string;
  text: string;
  from_name: string;
  at: string;
}

export interface ScheduleItem {
  drug: string;
  dose: string;
  times: string[];
}

export interface ConfirmResponse {
  schedule: ScheduleItem[];
  needs_child: string[];
}
