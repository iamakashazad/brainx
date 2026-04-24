import * as Tabs from "@radix-ui/react-tabs";
import { ScreenUploader } from "./ScreenUploader";
import { StaticUploader } from "./StaticUploader";
import { TextInput } from "./TextInput";

const tabTriggerClassName =
  "rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition data-[state=active]:border-primary data-[state=active]:bg-accent data-[state=active]:text-foreground";

export function ContentTypeTabs() {
  return (
    <Tabs.Root defaultValue="text" className="space-y-6">
      <Tabs.List className="grid gap-2 md:grid-cols-3">
        <Tabs.Trigger value="text" className={tabTriggerClassName}>
          Text
        </Tabs.Trigger>
        <Tabs.Trigger value="screens" className={tabTriggerClassName}>
          UI Screens
        </Tabs.Trigger>
        <Tabs.Trigger value="static" className={tabTriggerClassName}>
          Static Image
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="text">
        <TextInput />
      </Tabs.Content>
      <Tabs.Content value="screens">
        <ScreenUploader />
      </Tabs.Content>
      <Tabs.Content value="static">
        <StaticUploader />
      </Tabs.Content>
    </Tabs.Root>
  );
}
