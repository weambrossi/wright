"use client";

import { Group, RibbonTile } from "./RibbonPrimitives";
import { Icon } from "./RibbonPrimitives";
import type { AIAction } from "@/components/ai/AISidebar";

const ChatIcon = () => <Icon><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon>;
const CheckIcon = () => <Icon><polyline points="20 6 9 17 4 12" /></Icon>;
const BulbIcon = () => <Icon><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></Icon>;
const PencilIcon = () => <Icon><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" /></Icon>;
const ArrowIcon = () => <Icon><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Icon>;

export function AITab({
  onOpenAI,
}: {
  onOpenAI: (action?: AIAction) => void;
}) {
  return (
    <Group label="AI Assistant">
      <RibbonTile
        title="Open Wright AI chat"
        label="Chat"
        icon={<ChatIcon />}
        onClick={() => onOpenAI()}
      />
      <RibbonTile
        title="Check grammar and style"
        label="Grammar"
        icon={<CheckIcon />}
        onClick={() => onOpenAI("grammar")}
      />
      <RibbonTile
        title="Brainstorm ideas"
        label="Brainstorm"
        icon={<BulbIcon />}
        onClick={() => onOpenAI("brainstorm")}
      />
      <RibbonTile
        title="Rewrite the selected text"
        label="Rewrite"
        icon={<PencilIcon />}
        onClick={() => onOpenAI("rewrite")}
      />
      <RibbonTile
        title="Continue writing from the cursor"
        label="Continue"
        icon={<ArrowIcon />}
        onClick={() => onOpenAI("continue")}
      />
    </Group>
  );
}
