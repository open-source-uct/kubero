// Mismo criterio que NavDrawer.vue en el cliente: nombre + apellido si
// existen, si no el username (hay usuarios legacy sin firstName/lastName).
export function displayNameOf(user: {
  firstName?: string | null;
  lastName?: string | null;
  username: string;
}): string {
  return (
    `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username
  );
}
