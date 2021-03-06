/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { act, cleanup, render } from "@testing-library/preact";
import { renderHook } from "@testing-library/preact-hooks";
import { autorun, configure } from "mobx";
import { h } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Observer, useAsObservableSource, useLocalStore } from "../src";
import { resetMobx } from "./utils";

afterEach(cleanup);
afterEach(resetMobx);

describe("base useAsObservableSource should work", () => {
  it("with <Observer>", () => {
    let counterRender = 0;
    let observerRender = 0;

    function Counter({ multiplier }: { multiplier: number }) {
      counterRender++;
      const observableProps = useAsObservableSource({ multiplier });

      const store = useLocalStore(() => ({
        count: 10,
        get multiplied() {
          return observableProps.multiplier * this.count;
        },
        inc() {
          this.count += 1;
        },
      }));

      return (
        <Observer>
          {() => {
            observerRender++;
            return (
              <div>
                Multiplied count: <span>{store.multiplied}</span>
                <button id="inc" onClick={store.inc}>
                  Increment
                </button>
              </div>
            );
          }}
        </Observer>
      );
    }

    function Parent() {
      const [multiplier, setMultiplier] = useState(1);

      return (
        <div>
          <Counter multiplier={multiplier} />
          <button
            id="incmultiplier"
            onClick={() => setMultiplier((m) => m + 1)}
          />
        </div>
      );
    }

    const { container } = render(<Parent />);

    expect(container.querySelector("span")!.innerHTML).toBe("10");
    expect(counterRender).toBe(1);
    expect(observerRender).toBe(1);

    act(() => {
      (container.querySelector("#inc")! as any).click();
    });
    expect(container.querySelector("span")!.innerHTML).toBe("11");
    expect(counterRender).toBe(1);
    expect(observerRender).toBe(2);

    act(() => {
      (container.querySelector("#incmultiplier")! as any).click();
    });
    expect(container.querySelector("span")!.innerHTML).toBe("22");
    expect(counterRender).toBe(2);
    expect(observerRender).toBe(3);
  });
});

test("useAsObservableSource with effects should work", () => {
  const multiplierSeenByEffect: number[] = [];
  const valuesSeenByEffect: number[] = [];
  const thingsSeenByEffect: Array<[number, number, number]> = [];

  function Counter({ multiplier }: { multiplier: number }) {
    const observableProps = useAsObservableSource({ multiplier });
    const store = useLocalStore(() => ({
      count: 10,
      get multiplied() {
        return observableProps.multiplier * this.count;
      },
      inc() {
        this.count += 1;
      },
    }));

    useEffect(
      () =>
        autorun(() => {
          multiplierSeenByEffect.push(observableProps.multiplier);
        }),
      []
    );
    useEffect(
      () =>
        autorun(() => {
          valuesSeenByEffect.push(store.count);
        }),
      []
    );
    useEffect(
      () =>
        autorun(() => {
          thingsSeenByEffect.push([
            observableProps.multiplier,
            store.multiplied,
            multiplier,
          ]); // multiplier is trapped!
        }),
      []
    );

    return (
      <button id="inc" onClick={store.inc}>
        Increment
      </button>
    );
  }

  function Parent() {
    const [multiplier, setMultiplier] = useState(1);

    return (
      <div>
        <Counter multiplier={multiplier} />
        <button
          id="incmultiplier"
          onClick={() => setMultiplier((m) => m + 1)}
        />
      </div>
    );
  }

  const { container } = render(<Parent />);

  act(() => {
    (container.querySelector("#inc")! as any).click();
  });

  act(() => {
    (container.querySelector("#incmultiplier")! as any).click();
  });

  expect(valuesSeenByEffect).toEqual([10, 11]);
  expect(multiplierSeenByEffect).toEqual([1, 2]);
  expect(thingsSeenByEffect).toEqual([
    [1, 10, 1],
    [1, 11, 1],
    [2, 22, 1],
  ]);
});

describe("enforcing actions", () => {
  it("'never' should work", () => {
    configure({ enforceActions: "never" });
    const { result } = renderHook(() => {
      const [thing, setThing] = useState("world");
      useAsObservableSource({ hello: thing });
      useEffect(() => setThing("react"), []);
    });
    expect(result.error).not.toBeDefined();
  });
  it("only when 'observed' should work", () => {
    configure({ enforceActions: "observed" });
    const { result } = renderHook(() => {
      const [thing, setThing] = useState("world");
      useAsObservableSource({ hello: thing });
      useEffect(() => setThing("react"), []);
    });
    expect(result.error).not.toBeDefined();
  });
  it("'always' should work", () => {
    configure({ enforceActions: "always" });
    const { result } = renderHook(() => {
      const [thing, setThing] = useState("world");
      useAsObservableSource({ hello: thing });
      useEffect(() => setThing("react"), []);
    });
    expect(result.error).not.toBeDefined();
  });
});
