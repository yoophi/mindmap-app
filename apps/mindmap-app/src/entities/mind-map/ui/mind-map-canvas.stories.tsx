import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { demoMap } from "../model/document";
import { layoutMap } from "../model/layout";
import { MindMapCanvas } from "./mind-map-canvas";

const layout = layoutMap(demoMap());

const meta = {
  title: "Organisms/Mind map canvas",
  component: MindMapCanvas,
  args: {
    layout,
    selectedId: "launch",
    editingId: null,
    onSelect: () => {},
    onEdit: () => {},
    onRename: () => {},
    onCancelEdit: () => {},
    onMove: () => {},
  },
} satisfies Meta<typeof MindMapCanvas>;

export default meta;

export const BranchedMap: StoryObj<typeof meta> = {
  render: (args) => {
    const [selected, setSelected] = useState("launch");
    return (
      <div style={{ display: "flex", height: "min(600px, 80vh)" }}>
        <MindMapCanvas
          {...args}
          selectedId={selected}
          onSelect={setSelected}
          onEdit={setSelected}
        />
      </div>
    );
  },
};
