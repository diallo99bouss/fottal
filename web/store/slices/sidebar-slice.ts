import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
  activeGroup: string | null;
}

const initialState: SidebarState = {
  // Mobile drawer starts closed; desktop always shows the sidebar
  isOpen: false,
  isCollapsed: false,
  activeGroup: null,
};

const sidebarSlice = createSlice({
  name: "sidebar",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.isOpen = !state.isOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.isOpen = action.payload;
    },
    toggleCollapse(state) {
      state.isCollapsed = !state.isCollapsed;
    },
    setCollapsed(state, action: PayloadAction<boolean>) {
      state.isCollapsed = action.payload;
    },
    setActiveGroup(state, action: PayloadAction<string | null>) {
      state.activeGroup = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, toggleCollapse, setCollapsed, setActiveGroup } =
  sidebarSlice.actions;

export default sidebarSlice.reducer;
