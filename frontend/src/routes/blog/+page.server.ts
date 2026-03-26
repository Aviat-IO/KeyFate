import { getAllBlogPosts, getFeaturedPosts } from '$lib/blog/posts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const allPosts = getAllBlogPosts();
  const featuredPosts = getFeaturedPosts();
  const regularPosts = allPosts.filter((post) => !post.featured);

  return {
    allPosts,
    featuredPosts,
    regularPosts
  };
};
