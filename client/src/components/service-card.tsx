import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ServiceCardProps {
  title: string;
  description: string;
  image: string;
  bulletPoints: string[];
  isVideo?: boolean;
}

export function ServiceCard({ title, description, image, bulletPoints, isVideo = false }: ServiceCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-video relative">
        {isVideo ? (
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            controls={false}
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
            src={image}
          >
            <source src={image} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <img
            src={image}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-none space-y-2">
          {bulletPoints.map((point, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary">•</span>
              {point}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}