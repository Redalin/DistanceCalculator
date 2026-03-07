export const PERSON_COLORS = [
  '#228be6', // blue
  '#fa5252', // red
  '#40c057', // green
  '#fd7e14', // orange
  '#fab005', // yellow
  '#7950f2', // violet
  '#e64980', // pink
  '#20c997', // teal
  '#868e96', // gray
  '#212529', // dark
];

export function getPersonColor(
  people: { id: string }[],
  personId: string
): string {
  const index = people.findIndex((p) => p.id === personId);
  return PERSON_COLORS[index < 0 ? 0 : index % PERSON_COLORS.length];
}
