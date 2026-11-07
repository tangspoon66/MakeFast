import axios from 'axios';

export type CourseStepType = 'intro' | 'materials' | 'wiring' | 'blocks' | 'code' | 'compile' | 'flash' | 'verify' | 'challenge' | 'quiz' | 'completion';

export interface CourseMedia {
  asset_id: string;
  url: string | null;
  source: string | null;
  license: string | null;
  exact_variant: string | null;
  alt: string | null;
  verification_status: 'missing' | 'pending' | 'verified';
  is_real_photo: boolean;
  visual_kind: 'missing' | 'photo' | 'technical_render';
  variant_check: string | null;
}

export interface CourseComponent {
  id: string;
  name: string;
  kind: 'board' | 'sensor' | 'actuator' | 'accessory';
  exact_variant: string | null;
  quantity: number;
  purpose: string;
  compatibility_note: string;
  media: CourseMedia;
  pins?: CoursePin[];
  pinmap_status?: 'missing' | 'pending' | 'verified';
  pinmap_evidence?: string | null;
  pinmap_source?: string | null;
}

export interface CoursePin {
  id: string;
  label: string;
  kind: 'power' | 'ground' | 'digital' | 'analog' | 'i2c' | 'spi' | 'uart' | 'pwm';
  x?: number | null;
  y?: number | null;
  side?: 'top' | 'right' | 'bottom' | 'left' | null;
  aliases?: string[];
}

export interface CourseConnection {
  id: string;
  from_pin: { component_id: string; pin_id: string };
  to_pin: { component_id: string; pin_id: string };
  kind: CoursePin['kind'];
  direction: 'source_to_sink' | 'sink_to_source' | 'bidirectional' | 'static';
  label?: string | null;
  wire_color?: string | null;
  notes?: string | null;
  verified: boolean;
  verification_evidence?: string | null;
}

export interface CourseStep {
  id: string;
  type: CourseStepType;
  title: string;
  body: string;
  prerequisite_ids: string[];
  agent_anchor: string | null;
  material_ids: string[];
  connection_ids: string[];
  expected_observation: string | null;
  challenge: { task: string; success_observation: string } | null;
  quiz: { question: string; options: Array<{ id: string; text: string }>; answer_id: string; explanation: string } | null;
}

export interface PublishedCourse {
  slug: string;
  version: number;
  published_at: string;
  content: {
    title: string;
    summary: string;
    finished_media: CourseMedia;
    components: CourseComponent[];
    connections?: CourseConnection[];
    steps: CourseStep[];
  };
}

export async function getPublishedCourse(slug: string, version: number | null): Promise<PublishedCourse | null> {
  try {
    const response = await axios.get<PublishedCourse>(`/api/learning/courses/${encodeURIComponent(slug)}`, {
      withCredentials: true,
      params: version ? { version } : undefined,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
