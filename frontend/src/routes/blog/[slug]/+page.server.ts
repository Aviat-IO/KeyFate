import { getBlogPost } from '$lib/blog/posts';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = getBlogPost(params.slug);

  if (!post) {
    error(404, 'Blog post not found');
  }

  return {
    post
  };
};
