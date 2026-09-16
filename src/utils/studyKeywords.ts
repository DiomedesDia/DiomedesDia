const STUDY_KEYWORDS = [
  'estudiar',
  'estudio',
  'parcial',
  'examen',
  'exam',
  'study',
  'quiz',
  'tarea',
  'práctica',
  'practica',
  'evaluación',
  'evaluacion',
  'final',
  'entrega',
  'proyecto',
  'informe',
  'sustentación',
  'sustentacion',
]

/** Heurística simple: ¿el título del evento suena a algo que hay que estudiar? */
export function looksLikeStudyEvent(summary: string): boolean {
  const lower = summary.toLowerCase()
  return STUDY_KEYWORDS.some((keyword) => lower.includes(keyword))
}
