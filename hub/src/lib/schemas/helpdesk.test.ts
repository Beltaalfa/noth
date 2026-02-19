import { describe, it, expect } from "vitest";
import {
  createTicketBodySchema,
  messageBodySchema,
  encaminharBodySchema,
  patchTicketBodySchema,
} from "@/lib/schemas/helpdesk";

describe("helpdesk schemas", () => {
  describe("createTicketBodySchema", () => {
    it("accepts valid body", () => {
      const result = createTicketBodySchema.safeParse({
        clientId: "c1",
        assigneeType: "user",
        assigneeId: "u1",
        content: "  texto  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("texto");
        expect(result.data.priority).toBeUndefined();
      }
    });

    it("trims content and accepts optional priority", () => {
      const result = createTicketBodySchema.safeParse({
        clientId: "c1",
        assigneeType: "group",
        assigneeId: "g1",
        content: " msg ",
        subject: "Assunto",
        priority: "alta",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.content).toBe("msg");
        expect(result.data.priority).toBe("alta");
      }
    });

    it("rejects missing required fields", () => {
      expect(createTicketBodySchema.safeParse({}).success).toBe(false);
      expect(createTicketBodySchema.safeParse({ clientId: "c1" }).success).toBe(false);
      expect(createTicketBodySchema.safeParse({ clientId: "c1", assigneeType: "user", assigneeId: "u1" }).success).toBe(false);
    });

    it("rejects invalid assigneeType", () => {
      const result = createTicketBodySchema.safeParse({
        clientId: "c1",
        assigneeType: "invalid",
        assigneeId: "u1",
        content: "x",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("messageBodySchema", () => {
    it("accepts non-empty content", () => {
      const result = messageBodySchema.safeParse({ content: "resposta" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.content).toBe("resposta");
    });

    it("rejects empty content", () => {
      expect(messageBodySchema.safeParse({ content: "" }).success).toBe(false);
      expect(messageBodySchema.safeParse({}).success).toBe(false);
    });
  });

  describe("encaminharBodySchema", () => {
    it("accepts valid body with optional fields", () => {
      const result = encaminharBodySchema.safeParse({
        novoResponsavelUserId: "u2",
        operadoresAuxiliaresIds: ["u3"],
        comentario: "ok",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.novoResponsavelUserId).toBe("u2");
        expect(result.data.operadoresAuxiliaresIds).toEqual(["u3"]);
      }
    });

    it("defaults operadoresAuxiliaresIds to []", () => {
      const result = encaminharBodySchema.safeParse({ novoResponsavelUserId: "u2" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.operadoresAuxiliaresIds).toEqual([]);
    });

    it("rejects missing novoResponsavelUserId", () => {
      expect(encaminharBodySchema.safeParse({}).success).toBe(false);
    });
  });

  describe("patchTicketBodySchema", () => {
    it("accepts status and priority", () => {
      const result = patchTicketBodySchema.safeParse({
        status: "concluido",
        priority: "baixa",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty object", () => {
      expect(patchTicketBodySchema.safeParse({}).success).toBe(true);
    });

    it("rejects invalid status", () => {
      expect(patchTicketBodySchema.safeParse({ status: "invalid" }).success).toBe(false);
    });
  });
});
