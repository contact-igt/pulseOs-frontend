import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LandingPage from "../../../app/(marketing)/page";
import MarketingLayout from "../../../app/(marketing)/layout";
import { MarketingNav } from "../MarketingNav";
import { RoleSwitcher } from "../RoleSwitcher";
import { JourneyDemo } from "../JourneyDemo";
import { BeforeAfter } from "../BeforeAfter";
import { ConfigurableSection } from "../ConfigurableSection";
import { DemoRequestForm, buildDemoMailto } from "../DemoRequestForm";
import { JOURNEY_STAGES, NAV_LINKS, ROLES } from "../content";

describe("marketing nav", () => {
  it("links the five sections, Sign in goes to /login and Book a Demo to the demo section", () => {
    render(<MarketingNav />);
    const primary = screen.getByRole("navigation", { name: "Primary" });
    expect(within(primary).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")])).toEqual(NAV_LINKS.map((l) => [l.label, l.href]));
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: "Book a Demo" }).getAttribute("href")).toBe("#demo");
  });

  it("opens the mobile menu with a button, closes it with Escape and when a link is chosen", () => {
    render(<MarketingNav />);
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("navigation", { name: "Mobile" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Mobile" })).getByRole("link", { name: "How it Works" }));
    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
  });
});

describe("role switcher", () => {
  it("changes headline and panel on click, keeps tab semantics", () => {
    render(<RoleSwitcher />);
    expect(screen.getByTestId("role-headline").textContent).toBe(ROLES[0].headline);
    fireEvent.click(screen.getByRole("tab", { name: "Front Desk" }));
    expect(screen.getByTestId("role-headline").textContent).toBe(ROLES[1].headline);
    expect(screen.getByRole("tab", { name: "Front Desk" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Owner" }).getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("role-tab-frontdesk");
  });

  it("supports arrow, Home and End keys and wraps around", () => {
    render(<RoleSwitcher />);
    const list = screen.getByRole("tablist", { name: "Choose a role" });
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(screen.getByTestId("role-headline").textContent).toBe(ROLES[1].headline);
    fireEvent.keyDown(list, { key: "End" });
    expect(screen.getByTestId("role-headline").textContent).toBe(ROLES[3].headline);
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(screen.getByTestId("role-headline").textContent).toBe(ROLES[0].headline);
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(screen.getByTestId("role-headline").textContent).toBe(ROLES[3].headline);
  });
});

describe("journey selector", () => {
  it("shows the selected stage's card and moves with the keyboard", () => {
    render(<JourneyDemo />);
    const panel = screen.getByTestId("journey-panel");
    expect(within(panel).getByText(JOURNEY_STAGES[0].title)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Visit/ }));
    expect(within(screen.getByTestId("journey-panel")).getByText("Waiting · 8 min")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tablist", { name: "Patient journey stages" }), { key: "ArrowRight" });
    expect(screen.getByTestId("journey-panel").textContent).toContain("Seen by Dr. Menon");
  });

  it("notes that reminders depend on a connected messaging provider at the appointment stage", () => {
    render(<JourneyDemo />);
    fireEvent.click(screen.getByRole("tab", { name: /Appointment/ }));
    expect(screen.getByTestId("journey-panel").textContent).toMatch(/messaging provider is connected/);
  });
});

describe("before / with PulseOS", () => {
  it("starts on the fragmented view and switches both ways", () => {
    render(<BeforeAfter />);
    expect(screen.getByTestId("ba-before-view")).toBeTruthy();
    expect(screen.getByText(/What happened to this patient/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("ba-after"));
    expect(screen.getByTestId("ba-after-view")).toBeTruthy();
    expect(screen.getByText("Procedure advised")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ba-before"));
    expect(screen.getByTestId("ba-before-view")).toBeTruthy();
  });
});

describe("configurable fields", () => {
  it("really toggles fields on and off in the Add Lead preview; Phone stays locked on", () => {
    render(<ConfigurableSection />);
    const preview = () => screen.getByTestId("add-lead-preview").textContent ?? "";
    expect(preview()).toContain("Area / Locality");
    expect(preview()).not.toContain("Date of Birth");
    fireEvent.click(screen.getByRole("switch", { name: "Show Date of Birth on Add Lead" }));
    expect(preview()).toContain("Date of Birth");
    fireEvent.click(screen.getByRole("switch", { name: "Show Area / Locality on Add Lead" }));
    expect(preview()).not.toContain("Area / Locality");
    expect((screen.getByRole("switch", { name: "Show Phone on Add Lead" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("demo request form", () => {
  const fill = () => {
    for (const [label, value] of [["Name", "Dr Rao"], ["Hospital / Clinic", "Lakeview Eye"], ["Phone", "+91 90000 00000"], ["Work email", "rao@lakeview.example"]] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
  };

  it("builds a mailto that carries every field the visitor typed", () => {
    const url = buildDemoMailto("demo@example.test", { name: "Dr Rao", hospital: "Lakeview Eye", phone: "+91 90000 00000", email: "rao@lakeview.example" });
    expect(url.startsWith("mailto:demo@example.test?subject=PulseOS%20demo%20request&body=")).toBe(true);
    const body = decodeURIComponent(url.split("body=")[1]!);
    expect(body).toContain("Dr Rao");
    expect(body).toContain("Lakeview Eye");
    expect(body).toContain("+91 90000 00000");
    expect(body).toContain("rao@lakeview.example");
  });

  it("opens the request when a destination is configured", () => {
    const open = vi.fn();
    render(<DemoRequestForm to="demo@example.test" open={open} />);
    fill();
    fireEvent.submit(screen.getByTestId("demo-form"));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("demo-form-status").textContent).toMatch(/email app should now be open/);
  });

  it("never silently discards: with no destination it says so and sends nothing", () => {
    const open = vi.fn();
    render(<DemoRequestForm to="" open={open} />);
    fill();
    fireEvent.submit(screen.getByTestId("demo-form"));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByTestId("demo-form-status").textContent).toMatch(/nothing was sent/);
  });
});

describe("landing page content", () => {
  const renderPage = () => render(<MarketingLayout><LandingPage /></MarketingLayout>);

  it("has one h1, an ordered heading outline and the primary CTAs", () => {
    renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName[1]));
    levels.reduce((prev, cur) => {
      expect(cur - prev).toBeLessThanOrEqual(1);
      return cur;
    });
    expect(screen.getAllByRole("link", { name: "Book a Live Demo" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "See How PulseOS Works" }).getAttribute("href")).toBe("#how-it-works");
  });

  it("renders the public shell only: no app sidebar or developer login", () => {
    renderPage();
    expect(screen.queryByTestId("dev-login-block")).toBeNull();
    expect(screen.queryByText(/Developer access/i)).toBeNull();
    expect(document.querySelector(".app-sidebar")).toBeNull();
  });

  it("makes no unsupported claims", () => {
    const { container } = renderPage();
    const text = container.textContent ?? "";
    for (const banned of [/HIPAA/i, /NABH/i, /ABDM/i, /ISO ?27001/i, /AI-powered/i, /revolutioni[sz]e/i, /cutting-edge/i, /\bNamokar\b/i, /guaranteed/i, /#1\b/, /\bbest\b/i, /free trial/i]) {
      expect(text).not.toMatch(banned);
    }
    // The reminder statistic is framed as independent research, never as a PulseOS result.
    expect(text).toMatch(/Independent research, not a PulseOS result/);
    expect(text).not.toMatch(/PulseOS reduces no-shows/i);
  });

  it("cites the reminder study with a link to the source", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /Robotham et al\./ });
    expect(link.getAttribute("href")).toBe("https://pmc.ncbi.nlm.nih.gov/articles/PMC5093388/");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("describes only the product in structured data (no ratings, reviews or prices)", () => {
    const { container } = renderPage();
    const json = container.querySelector('script[type="application/ld+json"]')?.textContent ?? "";
    const data = JSON.parse(json);
    expect(data["@graph"].map((n: { "@type": string }) => n["@type"])).toEqual(["SoftwareApplication", "Organization"]);
    expect(json).not.toMatch(/aggregateRating|review|offers|price/i);
  });
});
