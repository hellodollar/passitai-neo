/** 同一轮练习使用稳定种子，避免刷新后题序再次改变；不修改原数组。 */
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const ordered = [...items]
  let state = 2166136261
  for (let index = 0; index < seed.length; index++) {
    state = Math.imul(state ^ seed.charCodeAt(index), 16777619) >>> 0
  }
  for (let index = ordered.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const target = Math.floor((state / 4294967296) * (index + 1))
    const value = ordered[index]!
    ordered[index] = ordered[target]!
    ordered[target] = value
  }
  return ordered
}
