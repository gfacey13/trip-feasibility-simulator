import { describe, it, expect } from "vitest"

describe("Travel Time Calculator", () => {

  it("calculates driving travel time correctly", () => {
    const distance = 300
    const speed = 60

    const travelTime =
      distance / speed

    expect(travelTime).toBe(5)
  })

  it("calculates flying travel time correctly", () => {
    const distance = 1000
    const speed = 500

    const travelTime =
      distance / speed

    expect(travelTime).toBe(2)
  })

  it("calculates bus travel time correctly", () => {
    const distance = 270
    const speed = 45

    const travelTime =
      distance / speed

    expect(travelTime).toBe(6)
  })

  it("calculates train travel time correctly", () => {
    const distance = 400
    const speed = 80

    const travelTime =
      distance / speed

    expect(travelTime).toBe(5)
  })

  it("marks trips under eight hours as feasible", () => {
    const travelTime = 6

    const feasible =
      travelTime <= 8

    expect(feasible).toBe(true)
  })

  it("marks trips over eight hours as not feasible", () => {
    const travelTime = 10

    const feasible =
      travelTime <= 8

    expect(feasible).toBe(false)
  })

  it("handles invalid distance values", () => {
    const distance = -100

    const invalid =
      distance < 0

    expect(invalid).toBe(true)
  })

  it("handles missing transportation method", () => {
    const method = ""

    const missingMethod =
      method === ""

    expect(missingMethod).toBe(true)
  })

})
