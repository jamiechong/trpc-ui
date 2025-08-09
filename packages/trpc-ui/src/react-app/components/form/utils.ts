import type { ParsedInputNode } from "@src/parse/parseNodeTypes";
import SuperJson from "superjson";
import { z } from "zod";

// TODO - Use an actual type instead of any? Not sure if it's really worth it or not.
export function defaultFormValuesForNode(node: ParsedInputNode): any {
  switch (node.type) {
    case "array":
      return [];
    case "boolean":
      return;
    case "discriminated-union": {
      const firstValue = node.discriminatedUnionValues[0]!;
      return defaultFormValuesForNode(
        node.discriminatedUnionChildrenMap[firstValue]!,
      );
    }
    case "enum":
      return;
    // return node.enumValues[0];
    case "object": {
      const obj: any = {};
      // biome-ignore lint/style/noVar: <This errors when not using var, leave it unless you are going to properly fix it>
      for (var [name, nodeChild] of Object.entries(node.children)) {
        obj[name] = defaultFormValuesForNode(nodeChild);
      }
      return obj;
    }
    case "literal":
      return node.value;
    case "string":
    case "number":
      // Seems it's more natural for these to have no value
      // as a default
      return;
  }
}

export type TRPCErrorType = z.infer<typeof TRPCErrorSchema>;

const TRPCErrorSchema = z.object({
  meta: z.object({
    responseJSON: z
      .array(
        z.object({
          error: z.object({
            code: z.number(),
            data: z.object({
              code: z.string(),
              httpStatus: z.number(),
              stack: z.string().optional(),
            }),
            message: z.string().optional(),
          }),
        }),
      )
      .min(1),
  }),
});

export function parseError(errorResponse: any, superJson: boolean) {
  // If responseJSON is not an array of errors (when allowBatching is false), wrap it in an array
  // since the rest of the code expects an array of errors.
  const responseJSON = errorResponse.meta.responseJSON;
  errorResponse.meta.responseJSON = Array.isArray(responseJSON) ? responseJSON : [responseJSON];

  if (!superJson) {
    const { success, data } = TRPCErrorSchema.safeParse(errorResponse);
    return { isError: success, data };
  }
  const errors = [];
  for (const error of errorResponse.meta.responseJSON) {
    if (error.error.json) {
      errors.push({
        error: SuperJson.deserialize(error.error),
      });
    }
  }
  const parsed = {
    ...errorResponse,
    meta: {
      ...errorResponse.meta,
      responseJSON: errors,
    },
  };
  const { success, data } = TRPCErrorSchema.safeParse(parsed);
  return { isError: success, data };
}
