import { describe, expect, it } from "vitest";
import { CRM_OUTPUT_FIELDS, type CrmOutputField } from "@/ai/schema/crm-output-schema";
import { DEFAULT_PIPELINE_CONFIGURATION, PipelineContext } from "@/pipeline/context";
import { ValidationStage } from "@/pipeline/stages/validation/validation-stage";
import type {
  ExtractedField,
  ExtractedRecord,
  SemanticExtractionResult,
} from "@/pipeline/domain/extraction";

function record(
  rowNumber: number,
  values: Partial<Record<CrmOutputField, string | null>>,
): ExtractedRecord {
  const fields: ExtractedField[] = CRM_OUTPUT_FIELDS.map((targetField) => {
    const value = values[targetField] ?? null;
    return { sourceHeader: targetField, targetField, value, confidence: value !== null ? 1 : 0 };
  });
  return { rowNumber, fields };
}

function buildContext(): PipelineContext {
  return PipelineContext.create("test-import", DEFAULT_PIPELINE_CONFIGURATION);
}

const APPROVABLE_RECORD_VALUES: Partial<Record<CrmOutputField, string | null>> = {
  name: "John Doe",
  email: "john@example.com",
  mobile_without_country_code: "9833311111",
  company: "Acme",
  city: "Bengaluru",
  state: "Karnataka",
  country: "India",
  created_at: "2026-01-15",
  crm_status: "GOOD_LEAD_FOLLOW_UP",
  data_source: "meridian_tower",
};

describe("ValidationStage", () => {
  it("reports outcome 'success' when every record is approved", async () => {
    const input: SemanticExtractionResult = { records: [record(1, APPROVABLE_RECORD_VALUES)] };
    const stage = new ValidationStage();

    const execution = await stage.execute(input, buildContext());

    expect(execution.result.outcome).toBe("success");
    if (execution.result.outcome === "success" || execution.result.outcome === "warning") {
      expect(execution.result.output.records).toHaveLength(1);
      expect(execution.result.output.records[0].approvalStatus).toBe("approved");
    }
  });

  it("reports outcome 'warning' when a record is skipped", async () => {
    const input: SemanticExtractionResult = { records: [record(1, {})] };
    const stage = new ValidationStage();

    const execution = await stage.execute(input, buildContext());

    expect(execution.result.outcome).toBe("warning");
  });

  it("never reports fatal_failure, even for a record that fails every check", async () => {
    const input: SemanticExtractionResult = {
      records: [record(1, { email: "john@example.com", crm_status: "garbage" })],
    };
    const stage = new ValidationStage();

    const execution = await stage.execute(input, buildContext());

    expect(execution.result.outcome).not.toBe("fatal_failure");
  });

  it("carries the dataset summary in stage metadata", async () => {
    const input: SemanticExtractionResult = { records: [record(1, APPROVABLE_RECORD_VALUES)] };
    const stage = new ValidationStage();

    const execution = await stage.execute(input, buildContext());

    expect(execution.result.info.metadata.totalRecords).toBe(1);
  });

  it("merges approval/repair statistics into the returned context", async () => {
    const input: SemanticExtractionResult = {
      records: [record(1, APPROVABLE_RECORD_VALUES), record(2, {})],
    };
    const stage = new ValidationStage();

    const execution = await stage.execute(input, buildContext());

    expect(execution.context.statistics.approvedRecords).toBe(1);
    expect(execution.context.statistics.skippedRecords).toBe(1);
  });

  it("accepts a config override at construction and applies it", async () => {
    const input: SemanticExtractionResult = { records: [record(1, {})] };
    const stage = new ValidationStage({ requireEmailOrPhone: false });

    const execution = await stage.execute(input, buildContext());

    if (execution.result.outcome === "success" || execution.result.outcome === "warning") {
      expect(execution.result.output.records[0].skipped).toBe(false);
    } else {
      expect.unreachable();
    }
  });
});
