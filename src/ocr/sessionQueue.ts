/** ORT 各执行后端共用一份 WASM 状态；所有调用方必须共用此队列。 */
export function createSessionQueue(): <T>(create: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(create: () => Promise<T>): Promise<T> => {
    const result = tail.then(create);
    tail = result.catch(() => undefined);
    return result;
  };
}
