export async function loadLevelFile(path) {
  const res = await fetch(path);
  return await res.json();
}