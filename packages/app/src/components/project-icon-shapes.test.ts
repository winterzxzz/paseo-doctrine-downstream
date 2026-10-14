import { describe, expect, it } from "vitest";
import {
  PROJECT_ICON_SHAPE_NAMES,
  deriveProjectIconShapeName,
  projectIconShape,
} from "@/components/project-icon-shapes";

describe("deriveProjectIconShapeName", () => {
  it("returns the same shape for the same project key every time", () => {
    const keys = ["/Users/me/FunFarm", "AppMobiles", "remote:host:/srv/winter_voice", ""];
    for (const key of keys) {
      expect(deriveProjectIconShapeName(key)).toBe(deriveProjectIconShapeName(key));
    }
  });

  it("pins known keys so a refactor cannot silently re-shape existing projects", () => {
    expect({
      FunFarm: deriveProjectIconShapeName("FunFarm"),
      AppMobiles: deriveProjectIconShapeName("AppMobiles"),
      CrawftMovie: deriveProjectIconShapeName("CrawftMovie"),
    }).toMatchInlineSnapshot(`
      {
        "AppMobiles": "cloud",
        "CrawftMovie": "blob",
        "FunFarm": "heart",
      }
    `);
  });

  it("spreads projects across every shape", () => {
    const seen = new Set(
      Array.from({ length: 500 }, (_, index) => deriveProjectIconShapeName(`project-${index}`)),
    );
    expect([...seen].sort()).toEqual([...PROJECT_ICON_SHAPE_NAMES].sort());
  });

  it("defines drawable geometry with a label point inside the box for every shape", () => {
    for (const name of PROJECT_ICON_SHAPE_NAMES) {
      const shape = projectIconShape(name);
      expect(shape.primitives.length).toBeGreaterThan(0);
      expect(shape.labelCenterY).toBeGreaterThan(6);
      expect(shape.labelCenterY).toBeLessThan(18);
    }
  });
});
