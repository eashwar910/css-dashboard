import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mail, GraduationCap, Briefcase } from 'lucide-react';
import { teamMembers } from '@/data/mockData';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const roleColors: Record<string, string> = {
  President: 'bg-primary/15 text-primary',
  'Vice President': 'bg-secondary/15 text-secondary-foreground',
  'Lead Developer': 'bg-primary/15 text-primary',
  'Event Coordinator': 'bg-secondary/15 text-secondary-foreground',
  Treasurer: 'bg-primary/15 text-primary',
  'Marketing Lead': 'bg-secondary/15 text-secondary-foreground',
  Webmaster: 'bg-primary/15 text-primary',
  'Outreach Coordinator': 'bg-secondary/15 text-secondary-foreground',
};

export function TeamView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Team Directory
        </h1>
        <p className="mt-1 text-muted-foreground">
          Meet the executive board and coordinators of the CS Society.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-primary">
              {teamMembers.length}
            </p>
            <p className="text-xs text-muted-foreground">Total Members</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-primary">4</p>
            <p className="text-xs text-muted-foreground">Departments</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-primary">4</p>
            <p className="text-xs text-muted-foreground">Year Groups</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-primary">8</p>
            <p className="text-xs text-muted-foreground">Roles</p>
          </CardContent>
        </Card>
      </div>

      {/* Team grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teamMembers.map((member) => (
          <Card
            key={member.id}
            className="group border-border transition-all hover:border-primary hover:shadow-lg animate-fade-in"
          >
            <CardContent className="p-5">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 border-2 border-border transition-colors group-hover:border-primary">
                  <AvatarFallback className="bg-secondary/20 text-lg font-bold text-secondary-foreground">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>

                <h3 className="mt-3 text-base font-semibold">{member.name}</h3>

                <Badge
                  variant="secondary"
                  className={`mt-1.5 rounded-full border-transparent ${roleColors[member.role] ?? 'bg-muted text-muted-foreground'}`}
                >
                  {member.role}
                </Badge>

                <div className="mt-3 w-full space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center justify-center gap-1.5">
                    <Briefcase className="h-3 w-3" />
                    {member.department}
                  </p>
                  <p className="flex items-center justify-center gap-1.5">
                    <GraduationCap className="h-3 w-3" />
                    {member.year}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full gap-2"
                  onClick={() =>
                    (window.location.href = `mailto:${member.email}`)
                  }
                >
                  <Mail className="h-3.5 w-3.5" />
                  Contact
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
