/**
 * The voices a receptionist can speak with, grouped by accent. Ids are the
 * provider's own — currently Amazon Polly voices exposed through Twilio's
 * <Say> verb. A different telephony adapter maps these in its own layer.
 */

export type VoiceOption = {
  id: string;
  label: string;
  accent: string;
  gender: "female" | "male";
  neural: boolean;
};

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "Polly.Amy-Neural", label: "Amy", accent: "British", gender: "female", neural: true },
  { id: "Polly.Emma-Neural", label: "Emma", accent: "British", gender: "female", neural: true },
  { id: "Polly.Brian-Neural", label: "Brian", accent: "British", gender: "male", neural: true },
  { id: "Polly.Arthur-Neural", label: "Arthur", accent: "British", gender: "male", neural: true },
  { id: "Polly.Niamh-Neural", label: "Niamh", accent: "Irish", gender: "female", neural: true },
  { id: "Polly.Joanna-Neural", label: "Joanna", accent: "American", gender: "female", neural: true },
  { id: "Polly.Matthew-Neural", label: "Matthew", accent: "American", gender: "male", neural: true },
  { id: "Polly.Ruth-Neural", label: "Ruth", accent: "American", gender: "female", neural: true },
  { id: "Polly.Olivia-Neural", label: "Olivia", accent: "Australian", gender: "female", neural: true },
  { id: "Polly.Aria-Neural", label: "Aria", accent: "New Zealand", gender: "female", neural: true },
  { id: "Polly.Amy", label: "Amy (standard)", accent: "British", gender: "female", neural: false },
  { id: "Polly.Brian", label: "Brian (standard)", accent: "British", gender: "male", neural: false },
];

export const LANGUAGES = [
  { code: "en-GB", label: "English (UK & Ireland)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "en-IE", label: "English (Ireland)" },
];

export function getVoiceOption(id: string | null | undefined): VoiceOption {
  return VOICE_OPTIONS.find((v) => v.id === id) ?? VOICE_OPTIONS[0];
}
