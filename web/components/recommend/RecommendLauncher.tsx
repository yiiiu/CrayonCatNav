import { getRecommendEnabled } from "@/lib/data/recommend.repo";
import { RecommendChat } from "./RecommendChat";

/** 后台打开「前台推荐」后才渲染右下角气泡。 */
export async function RecommendLauncher() {
  return (await getRecommendEnabled()) ? <RecommendChat /> : null;
}
