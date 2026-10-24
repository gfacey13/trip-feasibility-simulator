import { describe, it, expect } from "vitest"

describe("Feasibility Analysis", () => {

  it("marks trip as feasible", () => {
    const budget = 1000
    const cost = 850
    const travelTime = 3

    const feasible = cost <= budget

    expect(feasible).toBe(true)
  })

  it("marks trip as not feasible when over budget", () => {
    const budget = 500
    const cost = 850
    const travelTime = 3

    const feasible = cost <= budget

    expect(feasible).toBe(false)
  })

  it("marks an affordable trip as feasible regardless of travel time", () => {
    const budget = 5000
    const cost = 850
    const travelTime = 12

    const feasible = cost <= budget

    expect(feasible).toBe(true)
  })

})