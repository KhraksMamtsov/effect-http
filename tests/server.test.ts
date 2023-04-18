import * as Context from "@effect/data/Context";
import { pipe } from "@effect/data/Function";
import * as Effect from "@effect/io/Effect";
import * as Layer from "@effect/io/Layer";
import * as Schema from "@effect/schema/Schema";

import * as Http from "../src";

const Service1 = Context.Tag<number>();
const Service2 = Context.Tag<string>();

const layer1 = Layer.succeed(Service2, "hello world");
const layer2 = pipe(
  Effect.map(Service2, (value) => value.length),
  Effect.toLayer(Service1),
);

test("multiple provideLayer calls", async () => {
  const api = pipe(
    Http.api(),
    Http.get("doStuff", "/stuff", { response: Schema.number }),
  );

  const server = pipe(
    api,
    Http.server,
    Http.handle("doStuff", () => Effect.map(Service1, (value) => value + 2)),
    Http.provideLayer(layer2),
    Http.provideLayer(layer1),
    Http.exhaustive,
  );

  const result = await Effect.runPromise(server.handlers[0].fn({}));

  expect(result).toEqual(13);
});

test("validation error", async () => {
  const api = pipe(
    Http.api(),
    Http.get("hello", "/hello", {
      query: Schema.struct({
        country: pipe(Schema.string, Schema.pattern(/^[A-Z]{2}$/)),
      }),
      response: Schema.string,
    }),
  );

  const server = Http.exampleServer(api);

  await pipe(
    server,
    Http.listen(),
    Effect.flatMap(({ port }) =>
      pipe(api, Http.client(new URL(`http://localhost:${port}`)), (client) =>
        client.hello({ query: { country: "abc" } }),
      ),
    ),
    Effect.map((error) => {
      assert.fail("Expected failure");
    }),
    Effect.catchAll((error) => {
      expect(error).toMatchObject({ _tag: "InvalidQueryError" });
      return Effect.unit();
    }),
    Effect.runPromise,
  );
});
