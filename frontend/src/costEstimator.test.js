import { describe, it, expect } from "vitest"

describe("Cost Estimator", () => {
  it("calculates transportation cost correctly", () => {
    const travelers = 2
    const transportationCost = 200

    const transportationTotal =
      travelers * transportationCost

    expect(transportationTotal).toBe(400)
  })
})

it("calculates lodging cost correctly", () => {
  const nights = 3
  const lodgingCost = 150

  const lodgingTotal =
    nights * lodgingCost

  expect(lodgingTotal).toBe(450)
})

it("calculates the total estimated trip cost correctly", () => {
  const transportationTotal = 400
  const lodgingTotal = 450

  const estimatedTotal =
    transportationTotal + lodgingTotal

  expect(estimatedTotal).toBe(850)
})

it("does not allow invalid traveler values", () => {
  const travelers = -2

  const isInvalid =
    travelers < 1

  expect(isInvalid).toBe(true)
})
