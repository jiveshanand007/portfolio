import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogoTile, monogramFor } from "@/components/about/logo-tile";

describe("monogramFor", () => {
  it("uses the first letter of a single-word name", () => {
    expect(monogramFor("Acme")).toBe("A");
  });
  it("uses up to 3 word initials for multi-word names", () => {
    expect(monogramFor("Delhi Technological University")).toBe("DTU");
    expect(monogramFor("Delhi Technological University")).toBe("DTU");
  });
});

describe("LogoTile", () => {
  it("renders the logo image when a src is given", () => {
    render(<LogoTile name="Acme" logo="/logos/acme.svg" />);
    expect(screen.getByRole("img", { name: /acme/i })).toBeInTheDocument();
  });

  it("renders the monogram when no logo is given", () => {
    render(<LogoTile name="Delhi Technological University" />);
    expect(screen.getByText("DTU")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("falls back to the monogram when the image errors", () => {
    render(<LogoTile name="Acme" logo="/logos/acme.svg" />);
    fireEvent.error(screen.getByRole("img", { name: /acme/i }));
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
