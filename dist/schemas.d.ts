import * as z from "zod/v4";
export declare const orgLogin: z.ZodString;
export declare const responseFormat: z.ZodDefault<z.ZodEnum<{
    markdown: "markdown";
    json: "json";
}>>;
export type ResponseFormat = z.infer<typeof responseFormat>;
//# sourceMappingURL=schemas.d.ts.map