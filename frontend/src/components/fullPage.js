import { createContext, useContext } from 'react';

// Full-page mode (toggled in the top bar, see Layout.jsx): the sidebar is
// hidden and every page's title band shrinks to one line, so the content
// gets the whole screen.
export const FullPageContext = createContext(false);

export function useFullPage() {
  return useContext(FullPageContext);
}
