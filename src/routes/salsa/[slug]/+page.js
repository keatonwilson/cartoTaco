import { error } from '@sveltejs/kit';

export async function load({ params, parent }) {
	const { styles } = await parent();
	const style = styles.find((s) => s.slug === params.slug);
	if (!style) {
		throw error(404, 'No salsa by that name in the atlas');
	}
	return { style };
}
