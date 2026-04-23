import { useTranslation } from "@/hooks/useTranslation";

export default function HelloWorld() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50">
          {t("hello_world")}
        </h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          {t("welcome_to_care_kutumba")}
        </p>
      </div>
    </div>
  );
}
