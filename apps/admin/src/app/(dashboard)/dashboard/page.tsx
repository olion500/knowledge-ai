import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileText, GitPullRequest, Users } from "lucide-react";

const stats = [
  {
    name: "총 문서",
    value: "128",
    icon: FileText,
    description: "생성된 문서",
  },
  {
    name: "코드 참조",
    value: "256",
    icon: GitPullRequest,
    description: "추적 중인 코드",
  },
  {
    name: "사용자",
    value: "12",
    icon: Users,
    description: "활성 사용자",
  },
  {
    name: "처리량",
    value: "98%",
    icon: BarChart3,
    description: "성공률",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">시스템 현황 및 주요 지표</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 