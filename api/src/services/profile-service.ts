import { deleteUserData } from '../db/profile-repository';

// Elimina de forma definitiva el perfil y todos los datos del usuario. La verificación de identidad con Google y la
// confirmación se validan antes, en la ruta; aquí solo se ejecuta el borrado.
export async function deleteUserProfile(db: D1Database, userId: string): Promise<void> {
  await deleteUserData(db, userId);
}
