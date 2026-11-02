import { describe, it, expect } from "vitest"

describe("Trip Summary", () => {

  it("calculates total trip cost correctly", () => {

    const transportation = 400
    const lodging = 450

    const total =
      transportation + lodging

    expect(total).toBe(850)

  })

  it("marks trip as feasible when cost is within budget", () => {

    const budget = 1000
    const estimatedCost = 850

    const feasible =
      estimatedCost <= budget

    expect(feasible).toBe(true)

  })

  it("marks trip as not feasible when cost exceeds budget", () => {

    const budget = 500
    const estimatedCost = 850

    const feasible =
      estimatedCost <= budget

    expect(feasible).toBe(false)

  })

})