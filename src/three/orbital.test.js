import { describe, it, expect } from "vitest";
import { latLonToVector3, issPosition, EARTH_RADIUS } from "./orbital";

describe("latLonToVector3", () => {
  it("maps (0,0) to the +X point on the surface", () => {
    const v = latLonToVector3(0, 0);
    expect(v.x).toBeCloseTo(EARTH_RADIUS);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(0);
  });

  it("maps the north pole to +Y", () => {
    const v = latLonToVector3(90, 0);
    expect(v.y).toBeCloseTo(EARTH_RADIUS);
  });

  it("keeps points on the sphere of the requested radius", () => {
    const v = latLonToVector3(37, -122, 2);
    expect(v.length()).toBeCloseTo(2);
  });

  it("winds longitude eastward toward -Z (lon 90 → -Z)", () => {
    const v = latLonToVector3(0, 90);
    expect(v.z).toBeCloseTo(-1);
    expect(v.x).toBeCloseTo(0);
  });

  it("maps the south pole to -Y", () => {
    const v = latLonToVector3(-90, 0);
    expect(v.y).toBeCloseTo(-EARTH_RADIUS);
  });
});

describe("issPosition", () => {
  it("places the ISS above the Earth surface", () => {
    const v = issPosition(0, 0);
    expect(v.length()).toBeGreaterThan(EARTH_RADIUS);
  });

  it("places the ISS exactly one orbital altitude above the surface", () => {
    const v = issPosition(0, 0);
    expect(v.length()).toBeCloseTo(EARTH_RADIUS + 420 / 6371);
  });
});
