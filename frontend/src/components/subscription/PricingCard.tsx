import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Crown } from "lucide-react"
import Link from "next/link"
import { PaymentMethodSelector } from "./PaymentMethodSelector"
import { StripeCheckoutButton } from "./StripeCheckoutButton"

interface PricingCardProps {
  title: string
  description: string
  price: string
  subtext?: string
  savingsText?: string
  features: string[]
  buttonText: string
  buttonHref?: string
  stripeLookupKey?: string
  billingPeriod?: "monthly" | "yearly"
  isPopular?: boolean
  className?: string
}

export function PricingCard({
  title,
  description,
  price,
  subtext,
  savingsText,
  features,
  buttonText,
  buttonHref,
  stripeLookupKey,
  billingPeriod,
  isPopular = false,
  className = "",
}: PricingCardProps) {
  return (
    <Card
      className={`${isPopular ? "border-primary" : ""} ${className} flex flex-col`}
    >
      <CardHeader className="pb-8 text-center">
        <div className="flex min-h-[40px] items-center justify-center space-x-2">
          {isPopular && <Crown className="text-primary h-6 w-6" />}
          <CardTitle className="text-2xl">{title}</CardTitle>
          {isPopular && (
            <Badge className="bg-accent/50 text-accent-foreground dark:bg-accent dark:text-accent-foreground">
              Most Popular
            </Badge>
          )}
        </div>
        <div className="space-y-2 md:min-h-[200px]">
          <div className="text-foreground text-4xl font-bold">{price}</div>
          {subtext && (
            <p className="text-muted-foreground text-sm">{subtext}</p>
          )}
          {savingsText && (
            <p className="text-success text-sm font-medium">{savingsText}</p>
          )}
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-6">
        <ul className="flex-1 space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start space-x-3">
              <Check className="text-success mt-0.5 h-5 w-5 flex-shrink-0" />
              <span className="text-foreground text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Use StripeCheckoutButton for paid tiers, regular Link for free tier */}
        {stripeLookupKey ? (
          billingPeriod ? (
            <PaymentMethodSelector
              lookupKey={stripeLookupKey}
              amount={billingPeriod === "monthly" ? 9 : 90}
              interval={billingPeriod === "monthly" ? "monthly" : "yearly"}
            />
          ) : (
            <div className="space-y-2">
              <StripeCheckoutButton lookupKey={stripeLookupKey}>
                {buttonText}
              </StripeCheckoutButton>
              <p className="text-muted-foreground text-center text-xs">
                Sign up or log in to continue
              </p>
            </div>
          )
        ) : buttonHref ? (
          <Button
            className="w-full"
            variant={isPopular ? "default" : "outline"}
            asChild
          >
            <Link href={buttonHref}>{buttonText}</Link>
          </Button>
        ) : (
          <Button
            className="w-full"
            variant={isPopular ? "default" : "outline"}
            disabled
          >
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
