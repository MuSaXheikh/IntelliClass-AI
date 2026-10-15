import { beforeEach, describe, expect, it } from "vitest";
import { clearAllJoinInfo, readJoinInfo, writeJoinInfo } from "@/lib/joinStore";
import type { JoinResponse } from "@/types/contract";

const sample = { session: { id: "s1" }, livekit_url: null, livekit_token: null } as JoinResponse;

describe("joinStore", () => {
  beforeEach(() => {
    clearAllJoinInfo();
  });

  it("round-trips per session and clears everything on logout", () => {
    writeJoinInfo("s1", sample);
    writeJoinInfo("s2", { ...sample, session: { ...sample.session, id: "s2" } });
    expect(readJoinInfo("s1")?.session.id).toBe("s1");
    expect(readJoinInfo("s2")?.session.id).toBe("s2");
    clearAllJoinInfo();
    expect(readJoinInfo("s1")).toBeNull();
    expect(readJoinInfo("s2")).toBeNull();
  });
});
