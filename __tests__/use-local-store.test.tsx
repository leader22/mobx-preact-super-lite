/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-explicit-any */
import * as mobx from "mobx";
import { h } from "preact";
import { renderHook } from "@testing-library/preact-hooks";
import { act, cleanup, fireEvent, render } from "@testing-library/preact";

import { Observer, useLocalObservable } from "../src";
import { useEffect, useState } from "preact/hooks";
import { useObserver } from "../src/use-observer";

afterEach(cleanup);

test("base useLocalStore should work", () => {
  let counterRender = 0;
  let observerRender = 0;
  let outerStoreRef: any;

  function Counter() {
    counterRender++;
    const store = (outerStoreRef = useLocalObservable(() => ({
      count: 0,
      count2: 0, // not used in render
      inc() {
        this.count += 1;
      },
    })));

    return useObserver(() => {
      observerRender++;
      return (
        <div>
          Count: <span>{store.count}</span>
          <button onClick={store.inc}>Increment</button>
        </div>
      );
    });
  }

  const { container } = render(<Counter />);

  expect(container.querySelector("span")!.innerHTML).toBe("0");
  expect(counterRender).toBe(1);
  expect(observerRender).toBe(1);

  act(() => {
    container.querySelector("button")!.click();
  });
  expect(container.querySelector("span")!.innerHTML).toBe("1");
  expect(counterRender).toBe(2);
  expect(observerRender).toBe(2);

  act(() => {
    outerStoreRef.count++;
  });
  expect(container.querySelector("span")!.innerHTML).toBe("2");
  expect(counterRender).toBe(3);
  expect(observerRender).toBe(3);

  act(() => {
    outerStoreRef.count2++;
  });
  // No re-render!
  expect(container.querySelector("span")!.innerHTML).toBe("2");
  expect(counterRender).toBe(3);
  expect(observerRender).toBe(3);
});

describe("is used to keep observable within component body", () => {
  it("value can be changed over renders", () => {
    const TestComponent = () => {
      const obs = useLocalObservable(() => ({
        x: 1,
        y: 2,
      }));
      return (
        <div onClick={() => (obs.x += 1)}>
          {obs.x}-{obs.y}
        </div>
      );
    };
    const { container, rerender } = render(<TestComponent />);
    const div = container.querySelector("div")!;
    expect(div.textContent).toBe("1-2");
    fireEvent.click(div);
    // observer not used, need to render from outside
    rerender(<TestComponent />);
    expect(div.textContent).toBe("2-2");
  });

  describe("with props", () => {
    it("and useObserver", () => {
      let counterRender = 0;
      let observerRender = 0;

      function Counter({ multiplier }: { multiplier: number }) {
        counterRender++;

        const store = useLocalObservable(() => ({
          multiplier,
          count: 10,
          get multiplied() {
            return this.multiplier * this.count;
          },
          inc() {
            this.count += 1;
          },
        }));
        useEffect(() => {
          store.multiplier = multiplier;
        }, [store, multiplier]);

        return useObserver(
          () => (
            observerRender++,
            (
              <div>
                Multiplied count: <span>{store.multiplied}</span>
                <button id="inc" onClick={store.inc}>
                  Increment
                </button>
              </div>
            )
          )
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
      expect(counterRender).toBe(2); // 1 would be better!
      expect(observerRender).toBe(2);

      act(() => {
        (container.querySelector("#incmultiplier")! as any).click();
      });
      expect(container.querySelector("span")!.innerHTML).toBe("22");
      expect(counterRender).toBe(4); // TODO: avoid double rendering here!
      expect(observerRender).toBe(4); // TODO: avoid double rendering here!
    });

    it("with <Observer>", () => {
      let counterRender = 0;
      let observerRender = 0;

      function Counter({ multiplier }: { multiplier: number }) {
        counterRender++;

        const store = useLocalObservable(() => ({
          multiplier,
          count: 10,
          get multiplied() {
            return this.multiplier * this.count;
          },
          inc() {
            this.count += 1;
          },
        }));
        useEffect(() => {
          store.multiplier = multiplier;
        }, [store, multiplier]);

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
      expect(observerRender).toBe(4);
    });
  });
});

describe("enforcing actions", () => {
  it("'never' should work", () => {
    mobx.configure({ enforceActions: "never" });
    const { result } = renderHook(() => {
      const [multiplier, setMultiplier] = useState(2);
      const store = useLocalObservable(() => ({
        multiplier,
        count: 10,
        get multiplied() {
          return this.multiplier * this.count;
        },
        inc() {
          this.count += 1;
        },
      }));
      useEffect(() => {
        store.multiplier = multiplier;
      }, [store, multiplier]);
      useEffect(() => setMultiplier(3), []);
    });
    expect(result.error).not.toBeDefined();
  });
  it("only when 'observed' should work", () => {
    mobx.configure({ enforceActions: "observed" });
    const { result } = renderHook(() => {
      const [multiplier, setMultiplier] = useState(2);
      const store = useLocalObservable(() => ({
        multiplier,
        count: 10,
        get multiplied() {
          return this.multiplier * this.count;
        },
        inc() {
          this.count += 1;
        },
      }));
      useEffect(() => {
        store.multiplier = multiplier;
      }, [store, multiplier]);
      useEffect(() => setMultiplier(3), []);
    });
    expect(result.error).not.toBeDefined();
  });
  it("'always' should work", () => {
    mobx.configure({ enforceActions: "always" });
    const { result } = renderHook(() => {
      const [multiplier, setMultiplier] = useState(2);
      const store = useLocalObservable(() => ({
        multiplier,
        count: 10,
        get multiplied() {
          return this.multiplier * this.count;
        },
        inc() {
          this.count += 1;
        },
      }));
      useEffect(() => {
        store.multiplier = multiplier;
      }, [store, multiplier]);
      useEffect(() => setMultiplier(3), []);
    });
    expect(result.error).not.toBeDefined();
  });
});
