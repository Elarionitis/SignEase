import { useCallback, useRef, useState } from 'react';

export function useStableState<T>(initialState: T): [T, (value: T) => void] {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);

  const setStableState = useCallback((value: T) => {
    stateRef.current = value;
    setState(value);
  }, []);

  return [state, setStableState];
}
