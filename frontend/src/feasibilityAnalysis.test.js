import { describe, it, expect } from "vitest"

describe("Feasibility Analysis", () => {

  it("marks trip as feasible", () => {
    const budget = 1000
    const cost = 850
    const travelTime = 3

    const feasible =
      cost <= budget &&
      travelTime <= 8

    expect(feasible).toBe(true)
  })

  it("marks trip as not feasible when over budget", () => {
    const budget = 500
    const cost = 850
    const travelTime = 3

    const feasible =
      cost <= budget &&
      travelTime <= 8

    expect(feasible).toBe(false)
  })

  it("marks trip as not feasible when travel time is too long", () => {
    const budget = 5000
    const cost = 850
    const travelTime = 12

    const feasible =
      cost <= budget &&
      travelTime <= 8

    expect(feasible).toBe(false)
  })

})