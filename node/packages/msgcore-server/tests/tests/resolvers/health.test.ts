import { expect } from "chai";
import { graphqlUrl } from "../../setup.js";
import { HEALTH_QUERY } from "../../graphql/operations/conversations.js";

type HealthQueryResult = {
  health: string;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

describe("Health Query", () => {
  it("should return ok", async () => {
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: HEALTH_QUERY }),
    });

    const result =
      (await response.json()) as GraphQLResponse<HealthQueryResult>;

    expect(result.errors).to.equal(undefined);
    expect(result.data?.health).to.equal("ok");
  });
});
