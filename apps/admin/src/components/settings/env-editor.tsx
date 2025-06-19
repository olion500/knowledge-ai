"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "sonner";
import { useEnvVariables } from "@/lib/hooks/use-env-variables";
import { Loader2 } from "lucide-react";

interface EnvVariable {
  key: string;
  value: string;
  description?: string;
}

const ENV_CATEGORIES = {
  github: {
    title: "GitHub 설정",
    description: "GitHub 연동을 위한 설정",
    variables: [
      { key: "GITHUB_TOKEN", description: "GitHub Personal Access Token" },
      { key: "GITHUB_WEBHOOK_SECRET", description: "GitHub Webhook Secret" },
      { key: "GITHUB_ORGANIZATION", description: "GitHub Organization 이름" },
    ],
  },
  slack: {
    title: "Slack 설정",
    description: "Slack 연동을 위한 설정",
    variables: [
      { key: "SLACK_BOT_TOKEN", description: "Slack Bot User OAuth Token" },
      { key: "SLACK_APP_TOKEN", description: "Slack App-Level Token" },
      { key: "SLACK_SIGNING_SECRET", description: "Slack Signing Secret" },
    ],
  },
  jira: {
    title: "Jira 설정",
    description: "Jira 연동을 위한 설정",
    variables: [
      { key: "JIRA_HOST", description: "Jira 호스트 URL" },
      { key: "JIRA_EMAIL", description: "Jira 계정 이메일" },
      { key: "JIRA_API_TOKEN", description: "Jira API Token" },
    ],
  },
  llm: {
    title: "LLM 설정",
    description: "LLM 프로바이더 설정",
    variables: [
      { key: "OPENAI_API_KEY", description: "OpenAI API Key" },
      { key: "OLLAMA_HOST", description: "Ollama 호스트 주소" },
      { key: "LLM_PROVIDER", description: "사용할 LLM 프로바이더 (openai 또는 ollama)" },
    ],
  },
};

export function EnvEditor() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("github");
  const [envVariables, setEnvVariables] = useState<Record<string, string>>({});
  
  const {
    data,
    isLoading,
    error,
    updateVariables,
    isUpdating,
  } = useEnvVariables({
    onSuccess: () => {
      toast.success("환경 변수가 저장되었습니다.");
    },
    onError: () => {
      toast.error("환경 변수 저장에 실패했습니다.");
    },
  });

  useEffect(() => {
    if (data) {
      setEnvVariables(data);
    }
  }, [data]);

  const handleSave = () => {
    updateVariables(envVariables);
  };

  const handleInputChange = (key: string, value: string) => {
    setEnvVariables((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex h-[400px] items-center justify-center text-destructive">
          환경 변수를 불러오는데 실패했습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>환경 변수 설정</CardTitle>
        <CardDescription>
          시스템 연동에 필요한 환경 변수를 설정합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            {Object.entries(ENV_CATEGORIES).map(([key, category]) => (
              <TabsTrigger key={key} value={key}>
                {category.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(ENV_CATEGORIES).map(([key, category]) => (
            <TabsContent key={key} value={key} className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {category.description}
              </div>
              <div className="space-y-4">
                {category.variables.map((variable) => (
                  <div key={variable.key} className="space-y-2">
                    <label
                      htmlFor={variable.key}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {variable.key}
                    </label>
                    <Input
                      id={variable.key}
                      type="text"
                      value={envVariables[variable.key] || ""}
                      onChange={(e) =>
                        handleInputChange(variable.key, e.target.value)
                      }
                      placeholder={variable.description}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 