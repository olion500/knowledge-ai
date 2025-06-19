import { EnvEditor } from "@/components/settings/env-editor";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">설정</h2>
        <p className="text-muted-foreground">시스템 설정을 관리합니다.</p>
      </div>

      <div className="space-y-6">
        <EnvEditor />
      </div>
    </div>
  );
} 