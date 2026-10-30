/** Validation shared by HTTP and storage; project text is metadata, never a path. */
export function validateProjectText(name: unknown, description: unknown): asserts name is string {
  if (typeof name !== 'string' || !name.trim() || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('Project name must be nonempty text of at most 200 characters without control characters');
  if (typeof description !== 'string' || description.length > 5000 || description.includes('\0')) throw new Error('Project description must be text of at most 5000 characters without null bytes');
}
