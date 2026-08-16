const DEFAULT_CHUNK_SIZE_BYTES = 96 * 1024;

export const encodeQuestionChunks = (
  question: unknown,
  chunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES,
): Uint8Array[] => {
  const encoded = new TextEncoder().encode(JSON.stringify(question));
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < encoded.byteLength; offset += chunkSizeBytes) {
    chunks.push(encoded.slice(offset, offset + chunkSizeBytes));
  }
  return chunks.length ? chunks : [encoded];
};

export const decodeQuestionChunks = (chunks: Uint8Array[]) => {
  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const encoded = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    encoded.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(encoded));
};
